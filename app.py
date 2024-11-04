[Previous code up through the auth_status endpoint remains exactly as shown in the modified code, then continues with:]

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    user = await get_current_user(request, return_none=True)
    if not user:
        return RedirectResponse(url="/login", status_code=302)
    return templates.TemplateResponse("index.html", {"request": request})

@app.get('/login', response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.post('/login')
async def login_post(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    response: Response = None
):
    try:
        if not redis_manager.check_rate_limit("login", request.client.host):
            raise HTTPException(
                status_code=429,
                detail="Too many login attempts. Please try again later.",
                headers={"Retry-After": "60"}
            )

        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        if not auth_response.user:
            logger.error("Login failed: No user in response")
            return JSONResponse(
                status_code=400,
                content={"success": False, "message": "Invalid credentials"}
            )

        user = await get_user_by_email(email)
        if not user:
            user = await create_user(email)

        session_id = secrets.token_urlsafe(32)
        session_data = {
            "id": str(user.get("id")),
            "email": email,
            "last_refresh": time.time()
        }

        if not redis_manager.set_session(session_id, session_data, SESSION_TTL):
            raise HTTPException(
                status_code=500,
                detail="Failed to create session"
            )

        response = JSONResponse(content={"success": True, "message": "Login successful"})
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            httponly=SESSION_COOKIE_HTTPONLY,
            secure=SESSION_COOKIE_SECURE,
            samesite=SESSION_COOKIE_SAMESITE,
            max_age=SESSION_TTL
        )
        return response

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return JSONResponse(
            status_code=400,
            content={"success": False, "message": str(e)}
        )

@app.post('/logout')
async def logout(request: Request):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        redis_manager.delete_session(session_id)
    
    response = JSONResponse(content={"success": True, "message": "Logout successful"})
    response.delete_cookie(key=SESSION_COOKIE_NAME)
    return response

@app.get("/chat_history")
async def get_chat_history_endpoint(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse(content={"history": []})
    
    cache_key = f"chat_history:{user['id']}"
    cached_history = redis_manager.get_cache(cache_key)
    
    if cached_history:
        logger.info(f"Returning cached chat history for user {user['id']}")
        return JSONResponse(content={"history": cached_history})
        
    history = await get_chat_history(uuid.UUID(user['id']))
    redis_manager.set_cache(cache_key, history)
    return JSONResponse(content={"history": history})

@app.get("/video_analysis_history")
async def get_video_analysis_history_endpoint(request: Request):
    user = await get_current_user(request)
    if not user:
        return JSONResponse(content={"history": []})
    
    cache_key = f"video_history:{user['id']}"
    cached_history = redis_manager.get_cache(cache_key)
    
    if cached_history:
        logger.info(f"Returning cached video history for user {user['id']}")
        return JSONResponse(content={"history": cached_history})
        
    history = await get_video_analysis_history(uuid.UUID(user['id']))
    redis_manager.set_cache(cache_key, history)
    return JSONResponse(content={"history": history})

@app.get("/health")
async def health_check():
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "redis": await redis_manager.health_check(),
            "supabase": {
                "status": "unknown",
                "details": None
            }
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{supabase_url}/health",
                headers={"apikey": supabase_key},
                timeout=5.0
            )
            
            if response.status_code == 200:
                health_status["services"]["supabase"] = {
                    "status": "healthy",
                    "details": response.json()
                }
            else:
                health_status["services"]["supabase"] = {
                    "status": "degraded",
                    "details": {"status_code": response.status_code}
                }
                health_status["status"] = "degraded"
    except Exception as e:
        health_status["services"]["supabase"] = {
            "status": "unhealthy",
            "details": {"error": str(e)}
        }
        health_status["status"] = "unhealthy"
    
    return health_status

@app.get("/metrics")
async def metrics():
    try:
        redis_metrics = await redis_manager.get_metrics()
        
        metrics_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "redis": redis_metrics,
            "app": {
                "uptime": time.time() - app.state.start_time if hasattr(app.state, "start_time") else 0,
                "requests_total": app.state.request_count if hasattr(app.state, "request_count") else 0,
            }
        }
        return metrics_data
    except Exception as e:
        logger.error(f"Error collecting metrics: {str(e)}")
        return {
            "error": "Failed to collect metrics",
            "detail": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }

@app.post("/send_message")
async def send_message(
    request: Request,
    message: str = Form(...),
    videos: List[UploadFile] = File(None)
):
    user = await get_current_user(request)
    
    try:
        if videos:
            for video in videos:
                content = await video.read()
                file_id = str(uuid.uuid4())
                
                task_id = redis_manager.enqueue_task(
                    task_type=TaskType.VIDEO_PROCESSING,
                    payload={
                        "file_id": file_id,
                        "filename": video.filename,
                        "user_id": user["id"]
                    },
                    priority=TaskPriority.HIGH
                )
                
                if await redis_storage.store_file(file_id, content):
                    analysis_text, metadata = await chatbot.analyze_video(
                        file_id=file_id,
                        filename=video.filename
                    )
                    
                    analysis_task_id = redis_manager.enqueue_task(
                        task_type=TaskType.VIDEO_ANALYSIS,
                        payload={
                            "file_id": file_id,
                            "analysis": analysis_text,
                            "metadata": metadata,
                            "user_id": user["id"]
                        },
                        priority=TaskPriority.MEDIUM
                    )
                    
                    await insert_video_analysis(
                        user_id=uuid.UUID(user['id']),
                        upload_file_name=video.filename,
                        analysis=analysis_text,
                        video_duration=metadata.get('duration') if metadata else None,
                        video_format=metadata.get('format') if metadata else None
                    )
        
        response_text = await chatbot.send_message(message)
        
        await insert_chat_message(uuid.UUID(user['id']), message, 'user')
        await insert_chat_message(uuid.UUID(user['id']), response_text, 'bot')
        
        cache_key = f"chat_history:{user['id']}"
        redis_manager.invalidate_cache(cache_key)
        
        return JSONResponse(content={"response": response_text})
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
[Previous code up through the logout endpoint remains exactly as shown in modified code]

@app.get('/auth_status')
async def auth_status(request: Request):
    try:
        user = await get_current_user(request, return_none=True)
        return JSONResponse(content={
            "authenticated": user is not None,
            "user": user if user else None
        })
    except Exception as e:
        logger.error(f"Auth status error: {str(e)}")
        return JSONResponse(content={
            "authenticated": False,
            "error": str(e)
        })

@app.get("/chat_history")
async def get_chat_history_endpoint(request: Request):
    try:
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
    except Exception as e:
        logger.error(f"Error fetching chat history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch chat history"
        )

@app.get("/video_analysis_history")
async def get_video_analysis_history_endpoint(request: Request):
    try:
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
    except Exception as e:
        logger.error(f"Error fetching video analysis history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch video analysis history"
        )

@app.post("/send_message")
async def send_message(
    request: Request,
    message: str = Form(...),
    videos: List[UploadFile] = File(None)
):
    try:
        user = await get_current_user(request)
        
        if videos:
            for video in videos:
                content = await video.read()
                file_id = str(uuid.uuid4())
                
                if not await redis_storage.store_file(file_id, content):
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to store video file"
                    )
                
                try:
                    analysis_text, metadata = await chatbot.analyze_video(
                        file_id=file_id,
                        filename=video.filename
                    )
                    
                    await insert_video_analysis(
                        user_id=uuid.UUID(user['id']),
                        upload_file_name=video.filename,
                        analysis=analysis_text,
                        video_duration=metadata.get('duration') if metadata else None,
                        video_format=metadata.get('format') if metadata else None
                    )
                except Exception as video_error:
                    logger.error(f"Error analyzing video: {str(video_error)}")
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to analyze video"
                    )
        
        response_text = await chatbot.send_message(message)
        
        await insert_chat_message(uuid.UUID(user['id']), message, 'user')
        await insert_chat_message(uuid.UUID(user['id']), response_text, 'bot')
        
        cache_key = f"chat_history:{user['id']}"
        redis_manager.invalidate_cache(cache_key)
        
        return JSONResponse(content={"response": response_text})
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process message"
        )

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=3000, reload=True)
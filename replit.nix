{pkgs}: {
  deps = [
    pkgs.imagemagickBig
    pkgs.ffmpeg-full
    pkgs.python39Full
    pkgs.curl
    pkgs.datadog-agent
  ];
}

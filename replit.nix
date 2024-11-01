{pkgs}: {
  deps = [
    pkgs.docker_26
    pkgs.findutils
    pkgs.coreutils
    pkgs.curlWithGnuTls
    pkgs.bashInteractive
    pkgs.datadog-agent
    pkgs.imagemagickBig
    pkgs.ffmpeg-full
  ];
}

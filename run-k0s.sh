docker run -d --name k0s \
    --hostname k0s \
    --privileged \
    -v /var/lib/k0s \
    -p 6443:6443 \
    docker.io/k0sproject/k0s:latest
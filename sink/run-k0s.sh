#!/bin/bash

docker run -d --name k0s \
    --hostname k0s \
    --privileged \
    -v /var/lib/k0s \
    -p 6443:6443 \
    docker.io/k0sproject/k0s:latest

sleep 5

./setup-k0s-config.sh

kubectl create serviceaccount k8sadmin --kubeconfig=mock/kube_config.yaml -n kube-system
kubectl create clusterrolebinding k8sadmin --kubeconfig=mock/kube_config.yaml --clusterrole=cluster-admin --serviceaccount=kube-system:k8sadmin

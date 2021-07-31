#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

echo "*** Running Tests (k3s)..."

rm -rf ./logs

export CLUSTER_NAME="k3d-test"
echo "CLUSTER_NAME=${CLUSTER_NAME}"

export K8S_APISERVER=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
echo "K8S_APISERVER=${K8S_APISERVER}"

export K8S_CA_DATA=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster['certificate-authority-data']}")
echo "K8S_CA_DATA=${K8S_CA_DATA}"

export K8S_SECRET_NAME=$(kubectl --context ${CLUSTER_NAME} -n kube-system get secret | (grep k8sadmin || echo "$_") | awk '{print $1}')
echo "K8S_SECRET_NAME=${K8S_SECRET_NAME}"

export K8S_TOKEN=$(kubectl --context ${CLUSTER_NAME} -n kube-system describe secret ${K8S_SECRET_NAME} | grep token: | awk '{print $2}')
echo "K8S_TOKEN=${K8S_TOKEN}"

npm test $@


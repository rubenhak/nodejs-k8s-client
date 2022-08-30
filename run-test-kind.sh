#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

source configuration.sh

echo "*** Running Tests (kind)..."

rm -rf ./logs

export CLUSTER_NAME="kind-k8s-client-test"
echo "CLUSTER_NAME=${CLUSTER_NAME}"

export K8S_APISERVER=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
echo "K8S_APISERVER=${K8S_APISERVER}"

export K8S_CA_DATA=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster['certificate-authority-data']}")
echo "K8S_CA_DATA=${K8S_CA_DATA}"
echo ""

export K8S_CLIENT_CERT=$(kubectl config view --raw -o jsonpath="{.users[?(@.name==\"$CLUSTER_NAME\")].user['client-certificate-data']}")
echo "K8S_CLIENT_CERT=${K8S_CLIENT_CERT}"
echo ""

export K8S_CLIENT_KEY=$(kubectl config view --raw -o jsonpath="{.users[?(@.name==\"$CLUSTER_NAME\")].user['client-key-data']}")
echo "K8S_CLIENT_KEY=${K8S_CLIENT_KEY}"
echo ""

npm test $@
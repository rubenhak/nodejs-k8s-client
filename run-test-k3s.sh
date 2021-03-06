#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

rm -rf ./logs

export CLUSTER_NAME="k3d-test"
export K8S_APISERVER=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
export K8S_CA_DATA=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster['certificate-authority-data']}")

export K8S_TOKEN=$(kubectl -n kube-system describe secret $(kubectl --kubeconfig=mock/kube_config.yaml -n kube-system get secret | (grep k8sadmin || echo "$_") | awk '{print $1}') | grep token: | awk '{print $2}')

export TS_NODE_COMPILER_OPTIONS="{\"module\": \"commonjs\" }"
mocha -r ./node_modules/ts-node/register 'test/**/*.ts'


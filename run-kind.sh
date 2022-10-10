#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

source configuration.sh

kind create cluster --name ${KIND_CLUSTER_NAME} --kubeconfig ${KIND_KUBECONFIG_FILE} --image kindest/node:v1.25.2

kubectl --kubeconfig ${KIND_KUBECONFIG_FILE} apply -f sample-manifests/
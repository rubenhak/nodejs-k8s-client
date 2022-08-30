#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"

export KIND_CLUSTER_NAME=k8s-client-test
export KIND_KUBECONFIG_FILE=${MY_DIR}/mock/kube_config.yaml
export KUBECONFIG=${KIND_KUBECONFIG_FILE}
#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd ${MY_DIR}

source configuration.sh

echo "Running kubectl on KIND..."
kubectl ${@} --kubeconfig=${KIND_KUBECONFIG_FILE}
#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"

CFG=${MY_DIR}/mock/kube_config.yaml

echo "Running kubectl on k0s..."
kubectl ${@} --kubeconfig=${CFG}


# Alternative way to access
# docker exec k0s kubectl get nodes

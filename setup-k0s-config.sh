#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

export K8S_CONFIG_DATA=$(docker exec k0s cat /var/lib/k0s/pki/admin.conf)
echo "${K8S_CONFIG_DATA}" > mock/kube_config.yaml

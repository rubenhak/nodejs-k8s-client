#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

echo "*** Running Tests (REMOTE AWS)..."

rm -rf ./logs

export AWS_CLUSTER_NAME=prod-east-1
# my-cluster-name

export AWS_STS_REGIONAL_ENDPOINTS=regional 
export AWS_DEFAULT_REGION=us-east-1
export AWS_PROFILE=kubevious-deployer

export CONFIG_CLUSTER_NAME="${AWS_CLUSTER_NAME}.${AWS_DEFAULT_REGION}.eksctl.io"
echo "CONFIG_CLUSTER_NAME=${CONFIG_CLUSTER_NAME}"

export K8S_APISERVER=$(kubectl config view -o jsonpath="{.clusters[?(@.name==\"$CONFIG_CLUSTER_NAME\")].cluster.server}")
echo "K8S_APISERVER=${K8S_APISERVER}"

export K8S_CA_DATA=$(kubectl config view --raw -o jsonpath="{.clusters[?(@.name==\"$CONFIG_CLUSTER_NAME\")].cluster['certificate-authority-data']}")
echo "K8S_CA_DATA=${K8S_CA_DATA}"

JSON_DATA=$(aws-iam-authenticator token -i ${AWS_CLUSTER_NAME})
export K8S_TOKEN=$(echo "${JSON_DATA}" | jq -r .status.token)
echo "K8S_TOKEN=${K8S_TOKEN}"

npm test -- -g dev-experiment
# $@ 


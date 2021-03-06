#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

rm -rf ./logs

export K8S_CONFIG_DATA=$(docker exec k0s cat /var/lib/k0s/pki/admin.conf)
echo "${K8S_CONFIG_DATA}" > mock/kube_config.yaml

kubectl create serviceaccount k8sadmin --kubeconfig=mock/kube_config.yaml -n kube-system
kubectl create clusterrolebinding k8sadmin --kubeconfig=mock/kube_config.yaml --clusterrole=cluster-admin --serviceaccount=kube-system:k8sadmin

export CLUSTER_NAME="local"
export K8S_APISERVER=$(kubectl config view --kubeconfig=mock/kube_config.yaml -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster.server}")
export K8S_CA_DATA=$(kubectl config view --raw --kubeconfig=mock/kube_config.yaml -o jsonpath="{.clusters[?(@.name==\"$CLUSTER_NAME\")].cluster['certificate-authority-data']}")
# export K8S_TOKEN=$(kubectl get secrets --kubeconfig=mock/kube_config.yaml -o jsonpath="{.items[?(@.metadata.annotations['kubernetes\.io/service-account\.name']=='default')].data.token}"|base64 --decode)

export K8S_TOKEN=$(kubectl --kubeconfig=mock/kube_config.yaml -n kube-system describe secret $(kubectl --kubeconfig=mock/kube_config.yaml -n kube-system get secret | (grep k8sadmin || echo "$_") | awk '{print $1}') | grep token: | awk '{print $2}')

npm test --
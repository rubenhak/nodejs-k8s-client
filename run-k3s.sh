echo "*** Creating K3s Cluster..."
k3d cluster create test --servers 1 --agents 1
kubectl cluster-info

echo "*** Pausing..."
sleep 5

echo "*** Setting up credentials..."

export CLUSTER_NAME="k3d-test"
echo "CLUSTER_NAME=${CLUSTER_NAME}"

kubectl create serviceaccount k8sadmin -n kube-system --context ${CLUSTER_NAME} 
kubectl create clusterrolebinding k8sadmin --clusterrole=cluster-admin --serviceaccount=kube-system:k8sadmin --context ${CLUSTER_NAME}

echo "*** Pausing..."
sleep 30

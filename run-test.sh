#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd $MY_DIR

echo "*** Creating K3s Cluster..."
./run-k3s.sh

echo "*** Pausing..."
sleep 30

echo "*** Running Tests..."
./run-test-k3s.sh

echo "*** Cleaning Up..."
./stop-k3s.sh

#!/bin/bash
MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
cd "$MY_DIR"

SERVICE_NAME=$(yq "select(document_index == 0).name" qavor.yaml)

qavor test --only "${SERVICE_NAME}" --serial --verbose ${@}
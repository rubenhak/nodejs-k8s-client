const axios = require('axios')
const yaml = require('js-yaml');

const URL = 'https://api.digitalocean.com/v2/kubernetes'

var USER_TOKEN

module.exports = function (logger, token, config) {
    USER_TOKEN = token

    return listAllClusters().then(response => {
        console.log(response.data)
    })
}

function fetchCluster(clusterID = '3220bb97-0590-4240-ba62-09604c16d218') {
    const options = {
        url: `${URL}/clusters/${clusterID}`,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_TOKEN}`

        }
    };

    return axios(options)
}

function createCluster(data) {

    if (!data) {
        data = {
            "name": "prod-cluster-01",
            "region": "nyc1",
            "version": "1.14.1-do.4",
            "tags": [
                "production",
                "web-team"
            ],
            "node_pools": [
                {
                    "size": "s-1vcpu-2gb",
                    "count": 3,
                    "name": "frontend-pool",
                    "tags": [
                        "frontend"
                    ],
                    "labels": {
                        "service": "frontend",
                        "priority": "high"
                    }
                },
                {
                    "size": "c-4",
                    "count": 2,
                    "name": "backend-pool"
                }
            ]
        }
    }

    const body = data

    const options = {
        url: `${URL}/clusters`,
        method: 'post',
        body,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_TOKEN}`

        }
    };

    return axios(options)
}

function listAllClusters() {
    const options = {
        url: `${URL}/clusters`,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_TOKEN}`

        }
    };

    return axios(options)
}

function fetchConfig(clusterId = '3220bb97-0590-4240-ba62-09604c16d218') {
    const options = {
        url: `${URL}/clusters/${clusterId}/kubeconfig`,
        method: 'get',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${USER_TOKEN}`

        }
    };

    return axios(options).then(response => {
        yaml.safeLoadAll(response.data, function (doc) {
            USER_TOKEN = doc.users[0].user.token
        });
    })
}
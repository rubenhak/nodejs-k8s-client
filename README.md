# Kubernetes Node.js Client
Alternative K8s client library.

### Usage:
```js
var config = {
    caData: "...",
    token: "...."
}

var client = K8sClient.connect(null, "https://10.11.12.13", config);

client.Deployment.queryAll()
    .then(result => {
        console.log(result);
    })
```
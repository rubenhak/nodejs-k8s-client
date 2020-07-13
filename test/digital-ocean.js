const K8sClient = require('..');

var doContext = {

};

if (!process.env['DIGITAL_OCEAN_TOKEN']) {
    throw new Error('Missing env variable DIGITAL_OCEAN_TOKEN');
}

const token = process.env['DIGITAL_OCEAN_TOKEN']

K8sClient.connectToDO(null, token, null)
    .then(client => {
        doContext.client = client;
        return client;
    })
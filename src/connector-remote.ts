import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger';
import dotenv from 'dotenv'
import * as yaml from 'js-yaml';
import { exec, ExecOptions } from "child_process";
import { AgentOptions } from 'https';
import { readFileSync } from 'fs';
import { basename } from "path";

import { KubernetesClient, KubernetesClientConfig } from './client';
import { ClusterConnectParams } from './connector-types';

dotenv.config();

export function connectDefaultRemoteCluster(logger : ILogger, params? : ClusterConnectParams) : Promise<KubernetesClient>
{
    const kubeConfigPath = process.env.KUBECONFIG ?? `${process.env.HOME}/.kube/config`;

    return connectRemoteCluster(logger, kubeConfigPath, process.env.KUBE_CONTEXT_NAME, params);
}

export function connectRemoteCluster(logger : ILogger, kubeConfigPath: string, overrideKubeConfigContext?: string, params? : ClusterConnectParams) : Promise<KubernetesClient>
{
    params = params || {};
    params.skipAPIFetch = params.skipAPIFetch ?? false;
    
    logger.info("KUBE CONFIG FILE: %s", kubeConfigPath);
    const kubeConfigContents = readFileSync(kubeConfigPath, 'utf8');
    const kubeConfig = yaml.loadAll(kubeConfigContents)[0] as any;
    
    const contexts = _.makeDict(kubeConfig.contexts, x => x.name, x => x.context);
    logger.info("CONTEXTS: ", _.keys(contexts));

    const users = _.makeDict(kubeConfig.users, x => x.name, x => x.user);
    const clusters = _.makeDict(kubeConfig.clusters, x => x.name, x => x.cluster);

    const selectedContextName : string = 
        overrideKubeConfigContext ??
        kubeConfig['current-context'] ??
         _.keys(contexts)[0] ?? 
         'default';
    logger.info("SELECTED CONTEXT: %s", selectedContextName);

    const k8sContext = contexts[selectedContextName];
    logger.info("CONTEXT CONFIG: ", k8sContext);
    if (!k8sContext) {
        throw new Error(`Unknown context ${selectedContextName}`);
    }

    const user = users[k8sContext.user];
    // logger.info("USER CONFIG: ", user);

    const cluster = clusters[k8sContext.cluster];
    // logger.info("CLUSTER CONFIG: ", cluster);
    
    return fetchConnectConfig(user, cluster)
        .then(clientConfig => {
            // logger.info("CONNECT CONFIG: ", clientConfig);

            const k8sLogger = logger.sublogger('k8s');
            const client = new KubernetesClient(k8sLogger, clientConfig);

            return Promise.resolve()
                .then(() => {
                    if (!params?.skipAPIFetch) {
                        return client.init()
                    }
                })
                .then(() => {
                    return client;
                });
        })

    /*** HELPERS ***/

    function fetchConnectConfig(userConfig: any, clusterConfig: any)
    {
        const clientConfig : KubernetesClientConfig = {
            server: clusterConfig.server,
            httpAgent: {}
        }

        const agentOptions: AgentOptions = {};
        clientConfig.httpAgent = agentOptions;

        if (userConfig['client-certificate']) {
            agentOptions.cert = readFileSync(userConfig['client-certificate'], 'utf8')
        }

        if (userConfig['client-key']) {
            agentOptions.key = readFileSync(userConfig['client-key'], 'utf8')
        }

        return Promise.resolve()
            .then(() => fetchCA(clusterConfig))
            .then(value => {
                if (value) {
                    agentOptions.ca = value;
                }
            })
            .then(() => fetchClientCert(userConfig))
            .then(value => {
                if (value) {
                    agentOptions.cert = value;
                }
            })
            .then(() => fetchClientKey(userConfig))
            .then(value => {
                if (value) {
                    agentOptions.key = value;
                }
            })
            .then(() => fetchToken(userConfig))
            .then(value => {
                if (value) {
                    clientConfig.token = value;
                }
            })
            .then(() => clientConfig)
    }

    function fetchCA(clusterConfig: any) {
        if (clusterConfig['certificate-authority-data']) {
            return base64Decode(clusterConfig['certificate-authority-data']);
        } else if (clusterConfig['certificate-authority']) {
            return readFileSync(clusterConfig['certificate-authority'], 'utf8');
        }
    }

    function fetchClientCert(userConfig: any) {
        if (userConfig['client-certificate-data']) {
            return base64Decode(userConfig['client-certificate-data']);
        } else if (userConfig['client-certificate']) {
            return readFileSync(userConfig['client-certificate'], 'utf8');
        }
    }

    function fetchClientKey(userConfig: any) {
        if (userConfig['client-key-data']) {
            return base64Decode(userConfig['client-key-data']);
        } else if (userConfig['client-key']) {
            return readFileSync(userConfig['client-key'], 'utf8');
        }
    }

    function fetchToken(userConfig: any) {
        if (userConfig.token) {
            return userConfig.token;
        }

        if (userConfig.exec) {
            if (userConfig.exec.command) {
            return executeTool(
                userConfig.exec.command,
                userConfig.exec.args,
                userConfig.exec.env
            ).then((result) => {
                const doc = JSON.parse(result);
                return doc.status.token;
            });
            }
        }

        if (userConfig["auth-provider"]) {
            if (userConfig["auth-provider"]["config"]) {
                const authConfig = userConfig["auth-provider"]["config"];
                if (authConfig["cmd-path"]) {
                    return executeTool(
                        authConfig["cmd-path"],
                        authConfig["cmd-args"]
                        )
                        .then((result) => {
                            const doc = JSON.parse(result);
                            let tokenKey = authConfig["token-key"];
                            tokenKey = _.trim(tokenKey, "{}.");
                            const token = _.get(doc, tokenKey);
                            return token;
                        });
                }

                if (authConfig["access-token"]) {
                    return authConfig["access-token"];
                }
            }
        }
    }

    function executeTool(toolPath: string, args: string, envArray?: any[])
    {
        const toolName = basename(toolPath);

        let envDict : Record<string, string> = {};
        if (envArray) {
            envDict = _.makeDict(
            envArray,
            (x) => x.name,
            (x) => x.value
            );
        }
        return executeCommand(toolName, args, envDict);
    }


    function executeCommand(
        program: string,
        args: string,
        envDict?: Record<string, string>
    ) : Promise<string>
    {
        const options: ExecOptions = {};
        options.timeout = 20 * 1000;
        if (_.isArray(args)) {
            args = args.join(" ");
        }
        let cmd = program;
        if (args && args.length > 0) {
            cmd = program + " " + args;
        }
        if (envDict) {
            envDict = _.defaults(envDict, process.env);
            options.env = envDict;
        }

        logger.info("[_executeCommand] running: %s, options:", cmd, options);
        return Promise.construct((resolve, reject) => {
            exec(cmd, options, (error, stdout, stderr) => {
            if (error) {
                logger.error("[_executeCommand] failed: %s", error.message);
                logger.error("[_executeCommand] cmd: %s", error.cmd);
                logger.error("[_executeCommand] killed: %s", error.killed);
                logger.error("[_executeCommand] signal: %s", error.signal);
                logger.error("[_executeCommand] code: %s", error.code);
                logger.error("[_executeCommand] stdout: %s", stdout);
                logger.error("[_executeCommand] stderr: %s", stderr);
                reject(error);
            } else {
                logger.info("[_executeCommand] result: ", stdout);
                resolve(stdout);
            }
            });
        });
    }


    function base64Decode(str: string)
    {
        return Buffer.from(str, 'base64').toString('ascii');
    }
}
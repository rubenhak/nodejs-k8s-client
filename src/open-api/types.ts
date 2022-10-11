import { KubernetesOpenApiV3Response } from './open-api-v3';
import { KubernetesOpenApiV2Root } from './open-api-v2';

export interface KubernetesVersionInfoRaw
{
    major: string,
    minor: string,
    gitVersion: string,
    gitCommit: string,
    gitTreeState: string,
    buildDate: string,
    goVersion: string,
    compiler: string,
    platform: string,
}

export interface KubernetesVersionInfo
{
    major: number,
    minor: number,
    gitVersion: string,
    gitCommit: string,
    gitTreeState: string,
    buildDate: Date,
    goVersion: string,
    compiler: string,
    platform: string,
}


export interface K8sOpenApiPathExtension
{
    ["x-kubernetes-action"]?: string,
    ["x-kubernetes-group-version-kind"]?: {
        group: string;
        kind: string;
        version: string;
    }
}

export interface K8sOpenApiSpecs
{
    k8sVersion: string;
    openApiVersion: string;
    openApiV3Data?: Record<string, KubernetesOpenApiV3Response>;
    openApiV2Data?: KubernetesOpenApiV2Root;
}

export interface K8sOpenApiResource
{
    group: string;
    kind: string;
    version: string;
}
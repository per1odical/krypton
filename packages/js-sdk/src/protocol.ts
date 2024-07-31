import { DappIdentity, WalletIdentity } from "./common";

export type krGetIdentitiesResponse = {
  [key: number]: string[];
};

export interface krMethods {
  'kr_connected': { args: [DappIdentity], return: WalletIdentity };
  'kr_identities': { args: [boolean], return: krGetIdentitiesResponse };
  'kr_sign': { args: [string, string], return: string };
}

export type krMethodArgs<M extends keyof krMethods> = krMethods[M]['args'];
export type krMethodReturn<M extends keyof krMethods> = krMethods[M]['return'];

interface Security {
  '@context': 'https://w3id.org/security/v1' | ['https://w3id.org/security/v1'] & string[];

  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  }
}

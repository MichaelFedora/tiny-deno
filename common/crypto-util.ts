import { instantiateSha256, instantiateRipemd160, encodeBase58Address } from '../deps/libauth.ts';
import { assertEquals } from '../deps/std.ts';

interface HashUtil {
  hash(input: Uint8Array | string): Uint8Array;
}

const ripemd160: HashUtil  = await instantiateRipemd160();
const sha256: HashUtil = await instantiateSha256();

/**
 * Convert a hex string to a byte array
 * @param hex The hex string
 * @returns A byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  const num: number[] = [];
  for(let i = 0; i < hex.length; i += 2)
    num.push(Number('0x' + hex.slice(i, i + 2)));

  return new Uint8Array(num);
}

/**
 * Convert a byte array to a hex string
 *
 * @param bytes The bytes to convert
 * @returns A hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(i => ('0' + i.toString(16)).slice(-2)).join('');
}

export async function publicKeyToAddress(publicKey: string): Promise<string> {
  return await encodeBase58Address(sha256, 'p2pkh', ripemd160.hash(sha256.hash(hexToBytes(publicKey))));
}

Deno.test(async function TestPublicKeyToAddress() {
  console.log('\n');

  const { validateSecp256k1PrivateKey, instantiateSecp256k1 } = await import('../deps-testing/libauth.ts');

  const tests = [
    {
      privKey: '00cdce6b5f87d38f2a830cae0da82162e1b487f07c5affa8130f01fe1a2a25fb01',
      pubKey: '03af5a434efa8b75a491fa5f764925c78f660d0ae9cc3eeea4f0bab76925a72ff9',
      address: '1WykMawQRnLh7SWmmoRL4qTDNCgAsVRF1'
    },
    {
      privKey: '798a8cc81987e9015cb151458a1ae24e2b2903c44518c7e7750e85bd899cec18',
      pubKey: '023bf3f06bf218d2dfc0a5ea8be722ca449f48c5472fbae38552c164199a3356d1',
      address: '1QEsNRUHN74KaMKkwr6wPB5vjoQYxnmdUy'
    },
    {
      privKey: 'b34c33006c24187548a8466106a549b02b8b61462986d365b7ccd567280c8c2a',
      pubKey: '037f23762e7c414bdcd1412808bd942316d1971b43b51e7938f40a5ac1e6a75abb',
      address: '1ECUB1CvXrYufXXfUChYiA7vKb4GmoV4zF'
    }
  ];

  for(const test of tests) {
    console.log('# Test', tests.indexOf(test) + 1);

    const priv = hexToBytes(test.privKey.slice(0, 64));

    if(!validateSecp256k1PrivateKey(priv))
      throw new Error('Bad private key!');

    const secp256k1 = await instantiateSecp256k1(crypto.getRandomValues(new Uint8Array(32)));

    const pub = secp256k1.derivePublicKeyCompressed(priv);
    const pubKey = bytesToHex(pub);

    assertEquals(pub, hexToBytes(pubKey));

    console.log('Got public key:', pubKey);
    assertEquals(test.pubKey, pubKey);

    const addr = await publicKeyToAddress(pubKey);

    console.log('Got address:', addr);
    assertEquals(test.address, addr);
  }
});

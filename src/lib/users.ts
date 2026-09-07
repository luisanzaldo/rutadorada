export interface AdminUser {
  username: string;
  passwordHash: string;
  displayName: string;
  letterboxdUrl: string;
}

// Los hashes de contraseña se leen de variables de entorno, codificados en base64.
//
// Van en base64 porque un hash bcrypt tiene el formato $2b$10$<sal><hash>, y esos
// signos de dólar se corrompen cuando Vite sustituye import.meta.env en el bundle:
// en una cadena de reemplazo, $1, $&, $' y compañía tienen significado especial.
// El hash de ramonfigueroa llegaba al Worker con 39 de sus 60 caracteres, así que
// su login fallaba siempre. El alfabeto base64 no contiene $, de modo que sobrevive
// intacto. Para regenerar un valor: btoa('<hash bcrypt>').
//
// Se definen como HASH_LUISANZALDO_B64 y HASH_RAMONFIGUEROA_B64.
function decodeHash(encoded: string | undefined): string {
  if (!encoded) return '';
  return atob(encoded);
}

export const USERS: AdminUser[] = [
  {
    username: 'luisanzaldo',
    passwordHash: decodeHash(import.meta.env.HASH_LUISANZALDO_B64),
    displayName: 'Luis Anzaldo',
    letterboxdUrl: 'https://boxd.it/82ej9',
  },
  {
    username: 'ramonfigueroa',
    passwordHash: decodeHash(import.meta.env.HASH_RAMONFIGUEROA_B64),
    displayName: 'Moncho',
    letterboxdUrl: 'https://boxd.it/8jjEl',
  }
];

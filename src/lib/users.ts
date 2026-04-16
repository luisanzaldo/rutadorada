export interface AdminUser {
  username: string;
  passwordHash: string;
  displayName: string;
  letterboxdUrl: string;
}

// Los hashes de contraseña se leen de variables de entorno.
// Deben definirse como HASH_LUISANZALDO y HASH_RAMONFIGUEROA en .env y en Vercel.
export const USERS: AdminUser[] = [
  {
    username: 'luisanzaldo',
    passwordHash: import.meta.env.HASH_LUISANZALDO,
    displayName: 'Luis Anzaldo',
    letterboxdUrl: 'https://boxd.it/82ej9',
  },
  {
    username: 'ramonfigueroa',
    passwordHash: import.meta.env.HASH_RAMONFIGUEROA,
    displayName: 'Moncho',
    letterboxdUrl: 'https://boxd.it/8jjEl',
  }
];

# Segurança e publicação

Publique `firestore.rules` no Firebase Console. Depois, em Firebase Authentication, copie o UID da sua conta e crie em Firestore um documento `admins/<UID>` com `email`, `ativo: true` e `criadoEm`.

No Vercel, configure `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` e `FIREBASE_PRIVATE_KEY` usando uma conta de serviço do Firebase. Nunca coloque essa chave no navegador ou no repositório.

Catálogo, blog e configurações usam sincronização em tempo real: mudanças do painel aparecem automaticamente nos dispositivos abertos.

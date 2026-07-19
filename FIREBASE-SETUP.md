# Configuração do login individual — Le Beef 3.2.0

Siga esta ordem para não perder o acesso ao banco. Os eventos e participantes já cadastrados não serão apagados.

## 1. Ativar login por e-mail e senha

1. Abra o projeto `vendas-76f49` no Firebase Console.
2. Entre em **Build > Authentication > Sign-in method**.
3. Ative **E-mail/senha** e salve.
4. O login **Anônimo** pode ser desativado depois que o primeiro administrador estiver funcionando.

## 2. Criar o primeiro administrador

1. Ainda em **Authentication**, abra **Users** e clique em **Add user**.
2. Informe o seu e-mail e uma senha segura.
3. Copie o **User UID** criado pelo Firebase.
4. Abra **Realtime Database > Data**.
5. Crie o nó `users`, depois crie dentro dele um nó com o UID copiado.
6. Dentro de `users/SEU_UID`, grave exatamente estes campos:

```json
{
  "name": "Seu nome",
  "email": "seu@email.com",
  "role": "admin",
  "active": true
}
```

Use `true` como valor booleano, sem aspas.

## 3. Publicar as regras de segurança

1. Abra **Realtime Database > Rules**.
2. Copie todo o conteúdo do arquivo `database.rules.json` entregue com o site.
3. Substitua as regras antigas e clique em **Publish**.

As regras permitem:

- **Administrador (`admin`)**: controle completo de usuários, eventos, vendas, pagamentos e check-in.
- **Vendedor (`seller`)**: vendas, pagamentos, check-in e exportação; não administra eventos nem usuários.
- **Portaria (`door`)**: leitura dos participantes e alteração somente do campo de check-in.

## 4. Publicar o site

Envie os arquivos da versão 3.2.0 para o GitHub Pages. Entre com a conta de administrador criada no passo 2.

Depois do primeiro acesso, abra o menu da conta no topo e escolha **Gerenciar usuários**. Por essa tela você poderá criar vendedores e usuários da portaria, alterar perfis, bloquear acessos e enviar redefinição de senha.

## Recomendações

- Configure uma política de senha forte em **Authentication > Settings > Password policy**.
- Não compartilhe contas entre funcionários.
- Bloqueie imediatamente o usuário de alguém que não faça mais parte da equipe.
- Teste os três perfis antes do primeiro evento em produção.

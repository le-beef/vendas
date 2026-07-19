# Le Beef — painel de vendas de ingressos

Site estático em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages, com Firebase Authentication e Realtime Database.

## Login individual e permissões

A versão 3.2.0 usa contas individuais com e-mail e senha. A antiga senha compartilhada foi removida.

Perfis disponíveis:

- **Administrador**: usuários, eventos, vendas, pagamentos, check-in, Excel e relatório financeiro.
- **Vendedor**: vendas, pagamentos, check-in e Excel.
- **Portaria**: consulta de participantes e check-in.

As permissões são aplicadas na interface e também pelo arquivo `database.rules.json` no Realtime Database. Consulte [FIREBASE-SETUP.md](FIREBASE-SETUP.md) antes de publicar esta versão.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para o repositório no GitHub.
2. Abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**, a branch `main` e a pasta `/(root)`.
4. Salve e aguarde a atualização do endereço público.

## Configuração do Firebase

O arquivo `firebase-config.js` contém a configuração do projeto `vendas-76f49`.

Antes de usar a versão 3.2.0:

1. Ative o provedor **E-mail/senha** no Firebase Authentication.
2. Crie o primeiro usuário administrador.
3. Cadastre o perfil desse administrador em `users/{uid}`.
4. Publique o conteúdo de `database.rules.json` nas regras do Realtime Database.

As instruções completas estão em [FIREBASE-SETUP.md](FIREBASE-SETUP.md).

## Instalar como aplicativo

No endereço HTTPS do GitHub Pages, o botão **Instalar app** permite instalar o painel no Android e no computador. No iPhone/iPad, use **Compartilhar > Adicionar à Tela de Início** no Safari.

## Estrutura de dados

```text
users/{uid}       → nome, e-mail, perfil e situação do acesso
events/{eventId}  → evento, data, local e tipos/lotes
sales/{saleId}    → participante, contato, ingresso, valor, pagamento e check-in
```

## Recursos principais

- Eventos com tipos/lotes, valores e quantidades independentes.
- Participantes, pagamentos e check-in em tempo real.
- Busca e filtros combinados.
- WhatsApp normal ou Business.
- Exportação Excel por evento.
- Relatório financeiro dedicado.
- PWA adaptado ao computador e celular.
- Login individual, gerenciamento de usuários e permissões por função.

Ao abrir `index.html` diretamente no computador, o painel usa o modo local de demonstração. O login seguro e o banco compartilhado funcionam no site hospedado.

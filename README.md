# Ingressa — painel de vendas de ingressos

Site estático em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages e usar o Firebase Realtime Database.

## Publicar no GitHub Pages

1. Crie um repositório novo no GitHub e envie todos os arquivos desta pasta.
2. No repositório, abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**, a branch `main` e a pasta `/(root)`.
4. Salve. O GitHub mostrará o endereço público após a publicação.

## Ligar ao Firebase

1. No [Firebase Console](https://console.firebase.google.com/), crie um projeto e registre um app **Web**.
2. Em **Build > Realtime Database**, crie o banco de dados.
3. Em **Build > Authentication > Sign-in method**, ative **Anonymous**.
4. Copie o objeto de configuração do app Web para `firebase-config.js`. Não remova `databaseURL`.
5. Em **Realtime Database > Rules**, publique estas regras iniciais:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

Após salvar e publicar novamente no GitHub, o indicador no topo mostrará “Firebase conectado”. Sem configuração, a página fica em modo demonstração e salva dados apenas neste navegador.

## Senha de acesso

O painel solicita a senha `838726` uma única vez por navegador e mantém a autorização nesse dispositivo. Como o site é estático e publicado no GitHub, essa é uma trava visual simples: ela não substitui um login seguro. Para restringir efetivamente o acesso aos dados em produção, use contas de administrador no Firebase Authentication e regras por usuário.

## Estrutura de dados

O sistema grava duas coleções no Realtime Database:

```
events/{eventId}  → nome, data, local, capacidade e tipos de ingresso com preços
sales/{saleId}    → evento, tipo de ingresso, participante, contato, quantidade, total, pagamento e check-in
```

Na tela **Ver todas**, o botão **Baixar Excel** cria uma planilha `.xlsx` com o cabeçalho preto e as linhas alternadas em cinza do modelo fornecido. A exportação funciona no computador e no celular, sem instalar aplicativos extras no site.

> As regras acima protegem o banco de visitantes anônimos, mas qualquer pessoa que acesse o seu site terá uma conta anônima válida. Para um painel de produção, o próximo passo recomendado é trocar por login de administrador e restringir as regras por usuário.

Referências: documentação do [Realtime Database para Web](https://firebase.google.com/docs/database/web/start?hl=pt-BR) e de [leitura/escrita de dados](https://firebase.google.com/docs/database/web/read-and-write).

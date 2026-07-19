# Le Beef — painel de vendas de ingressos

Site estático em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages, com Firebase Authentication e Realtime Database.

## Login individual, permissões e eventos permitidos

A versão 3.3.2 usa contas individuais com e-mail e senha, traz o ícone oficial da Le Beef e melhora a leitura dos participantes no celular com cartões compactos e alternados.

- **Administrador**: visualiza todos os eventos e controla usuários, eventos, vendas, pagamentos, check-in, Excel e relatório financeiro.
- **Vendedor**: visualiza somente os eventos marcados pelo administrador; nesses eventos, trabalha com vendas, pagamentos, check-in e Excel.
- **Portaria**: visualiza somente os eventos marcados pelo administrador; nesses eventos, consulta participantes e realiza check-in.

As permissões são aplicadas na interface e nas regras do Realtime Database. Consulte [FIREBASE-SETUP.md](FIREBASE-SETUP.md) antes de publicar esta versão.

## Publicar no GitHub Pages

1. Envie todos os arquivos desta pasta para o repositório no GitHub.
2. Abra **Settings > Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**, a branch `main` e a pasta `/(root)`.
4. Salve e aguarde a atualização do endereço público.

## Atualização obrigatória no Firebase

Na atualização para a versão 3.3.2, envie primeiro os arquivos ao GitHub Pages, entre como administrador e marque os eventos permitidos. Em seguida, publique o conteúdo de `database.rules.json` em **Realtime Database > Rules**.

As instruções completas estão em [FIREBASE-SETUP.md](FIREBASE-SETUP.md).

## Instalar como aplicativo

No endereço HTTPS do GitHub Pages, o botão **Instalar app** permite instalar o painel no Android e no computador. No iPhone/iPad, use **Compartilhar > Adicionar à Tela de Início** no Safari.

## Estrutura de dados

```text
users/{uid}       → nome, e-mail, perfil, situação e eventIds permitidos
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
- Login individual e acesso restrito aos eventos escolhidos pelo administrador.

Ao abrir `index.html` diretamente no computador, o painel usa o modo local de demonstração. O login seguro e o banco compartilhado funcionam no site hospedado.

# Le Beef — painel de vendas de ingressos

Site estático em HTML, CSS e JavaScript, pronto para publicar no GitHub Pages, com Firebase Authentication e Realtime Database.

## Login individual, permissões e histórico

A versão 3.12.2 simplifica o indicador de conexão do menu superior. O texto agora mostra somente **Conectado** ou **Desconectado**, sem exibir o nome Firebase.

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

Na atualização para a versão 3.12.2, envie os arquivos alterados ao GitHub Pages. Eventos, pacotes, cortesias e vendas antigas continuam disponíveis normalmente; esta versão não exige alteração nas regras do banco de dados.

As instruções completas estão em [FIREBASE-SETUP.md](FIREBASE-SETUP.md).

## Instalar como aplicativo

No endereço HTTPS do GitHub Pages, o botão **Instalar app** permite instalar o painel no Android e no computador. No iPhone/iPad, use **Compartilhar > Adicionar à Tela de Início** no Safari.

## Estrutura de dados

```text
users/{uid}       → nome, e-mail, perfil, situação e eventIds permitidos
events/{eventId}  → evento, data, local, tipos/lotes e pacotes promocionais
sales/{saleId}    → participante, contato, ingressos avulsos/pacotes, quantidades, valor, forma/data do pagamento, vendedor e check-in
auditLogs/{logId} → ação, venda, participante, usuário, perfil, data e horário
```

## Recursos principais

- Eventos com tipos/lotes, valores e quantidades independentes.
- Uma única venda pode reunir vários tipos de ingresso e quantidades separadas para o mesmo participante.
- Pacotes promocionais com composição de ingressos, desconto percentual e baixa automática no estoque individual.
- Participantes, pagamentos e check-in em tempo real.
- Busca e filtros combinados.
- WhatsApp normal ou Business.
- Exportação Excel por evento.
- Relatório financeiro dedicado.
- Fechamento por vendedor e período.
- Forma e data do pagamento na tela e na planilha Excel.
- PWA adaptado ao computador e celular.
- Login individual e acesso restrito aos eventos escolhidos pelo administrador.
- Histórico administrativo de criações, edições, exclusões, pagamentos e check-ins.

Ao abrir `index.html` diretamente no computador, o painel usa o modo local de demonstração. O login seguro e o banco compartilhado funcionam no site hospedado.

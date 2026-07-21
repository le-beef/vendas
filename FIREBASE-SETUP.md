# Configuração de segurança e financeiro — Le Beef 3.13.1

Os eventos e participantes já cadastrados não serão apagados.

## 1. Publicar o site e marcar os eventos

1. Publique os arquivos da versão 3.13.1 no GitHub Pages.
2. Entre com a conta de administrador.
3. No menu da conta, abra **Gerenciar usuários**.
4. Ao criar um vendedor ou usuário da portaria, marque um ou mais **Eventos permitidos**.
5. Para uma conta já existente, abra **Acesso aos eventos**, marque os eventos e clique em **Salvar eventos permitidos**.

## 2. Publicar as novas regras

1. Abra o projeto `vendas-76f49` no Firebase Console.
2. Entre em **Realtime Database > Rules**.
3. Copie todo o conteúdo do arquivo `database.rules.json` desta versão.
4. Substitua as regras antigas e clique em **Publish**.

As novas regras garantem que:

- o administrador tenha acesso a todos os eventos;
- vendedor e portaria leiam somente eventos marcados em seus perfis;
- as vendas sejam consultadas por evento;
- vendedor altere somente vendas dos eventos permitidos;
- portaria faça check-in somente nos eventos permitidos.
- cada alteração de venda crie um registro imutável em `auditLogs`;
- somente o administrador consiga consultar o histórico completo;
- vendedor e portaria gravem no histórico apenas ações permitidas por seus perfis.

## 3. Como consultar o histórico

1. Entre no painel com uma conta de administrador.
2. Selecione o evento.
3. Clique em **Histórico** no cabeçalho do evento.
4. Consulte a ação, o participante, o usuário responsável, o perfil, a data e o horário.

O histórico registra ações realizadas depois da publicação das regras da versão 3.4.0. Na versão 3.13.1, a visão dos tipos vendidos por vendedor passou a abrir sob demanda dentro do fechamento da equipe. A estrutura do Firebase permanece inalterada.

O perfil é gravado assim:

```json
{
  "name": "Nome da pessoa",
  "email": "pessoa@email.com",
  "role": "seller",
  "active": true,
  "eventIds": {
    "ID_DO_EVENTO_1": true,
    "ID_DO_EVENTO_2": true
  }
}
```

## 4. Contas já existentes

Vendedores e usuários da portaria criados na versão anterior não possuem `eventIds`. Por segurança, eles não verão nenhum evento até o administrador marcar e salvar os eventos permitidos. A conta de administrador continua vendo tudo.

## Primeiro administrador

Se ainda precisar criar o primeiro administrador, ative **E-mail/senha** em **Authentication > Sign-in method**, crie o usuário e grave em `users/SEU_UID`:

```json
{
  "name": "Seu nome",
  "email": "seu@email.com",
  "role": "admin",
  "active": true
}
```

Administradores não precisam do campo `eventIds`.

## Recomendações

- Não compartilhe contas entre funcionários.
- Bloqueie imediatamente quem não fizer mais parte da equipe.
- Ao criar um novo evento, lembre-se de liberá-lo para os usuários que trabalharão nele.
- Teste uma conta de vendedor e uma de portaria antes do evento.

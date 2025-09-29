---
"@skip-go/widget": patch
---

Fix AuthZ grant handling:

- Include stream start offset when computing grant expiration so grants last through `startAt`/`interval` + `duration`.
- Query grants for the ICA grantee (`trustlessAgentICAAddress`) to match the grantee used when creating `MsgGrant`.

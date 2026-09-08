```bash
curl -s -X POST http://localhost:3000/documents/upload/parse \
  -F 'file=@./test-files/01-travel-expense-policy.pdf' \
  -F 'authorId=10001' \
  -F 'createBy=10001' | jq
```

```bash
DOC_ID='354995533082791936'
curl -s "http://localhost:3000/documents/${DOC_ID}" | jq
```

```bash
curl -s -X POST http://localhost:3000/documents/upload/parse \
  -F 'file=@./test-files/申论总结课.pptx' \
  -F 'authorId=10001' \
  -F 'createBy=10001' | jq
```

```bash
DOC_ID='354995533082791936'
curl -s "http://localhost:3000/documents/${DOC_ID}" | jq
```

<script>
export default {
  name: `page-404`,
  asyncData({ error }) {
    error({ statusCode: 404, message: `Not found` })
  },
}
</script>

<script>
export default {
  // eslint-disable-next-line vue/component-definition-name-casing
  name: 'page-404',
  asyncData({ error }) {
    error({ statusCode: 404, message: 'Not found' });
  },
};
</script>

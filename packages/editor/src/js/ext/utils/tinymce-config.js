//////
// TINY MCE CONFIGURATION
//////
const tinymceConfigFull = {
  toolbar1:
    'bold italic forecolor backcolor | fontsizedialogbutton styleselect letterspacingselect removeformat specialcharacters variables extendColors | linkcolorbutton unlinkcolorbutton | pastetext code',
  //- add colorpicker & custom plugins
  //- https://www.tinymce.com/docs/plugins/colorpicker/
  plugins: [
    'linkcolor hr paste lists textcolor colorpicker code spacing fontsizedialog variables fontsizedialog specialcharacters extendColors',
  ],
  link_text_decoration_list: [
    { text: 'Underline', value: '' },
    { text: 'Normal', value: 'none' },
  ],
  //- https://www.tinymce.com/docs/configure/content-formatting/#style_formats
  style_formats: [
    {
      title: 'Inline',
      items: [
        { title: 'Bold', icon: 'bold', inline: 'strong' },
        { title: 'Italic', icon: 'italic', inline: 'em' },
        {
          title: 'Underline',
          icon: 'underline',
          inline: 'span',
          styles: { 'text-decoration': 'underline' },
        },
        {
          title: 'Strikethrough',
          icon: 'strikethrough',
          inline: 'span',
          styles: { 'text-decoration': 'line-through' },
        },
        { title: 'Superscript', icon: 'superscript', inline: 'sup' },
        { title: 'Subscript', icon: 'subscript', inline: 'sub' },
        { title: 'Code', icon: 'code', inline: 'code' },
      ],
    },
  ],
};

module.exports = tinymceConfigFull;

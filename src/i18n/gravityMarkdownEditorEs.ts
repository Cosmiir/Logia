/**
 * Spanish translations for @gravity-ui/markdown-editor
 *
 * Gravity UI only ships 'en' and 'ru' keysets. This file registers a custom
 * 'es' language on the editor's internal i18n instance so that all UI strings
 * (placeholders, toolbar labels, dialogs…) appear in Spanish when the app
 * language is set to 'es'.
 *
 * Usage: import this file once, early in the app bootstrap (e.g. in main.tsx
 * or i18n/config.ts), BEFORE any Gravity editor component mounts.
 */

// The editor exposes its internal I18N instance through this path.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — private but stable export
import { i18n } from '@gravity-ui/markdown-editor/i18n';

const LANG = 'es';

// ─── action-previews ────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'action-previews', {
  'text': "Aquí hay un texto sin título.\nEl título y el texto debajo\npueden ponerse en negrita, cursiva, color,\ntachado o subrayado. También puedes añadir listas,\ntablas, enlaces, fórmulas, anclas\ny bloques de código.",
  'text-with-head': "Aquí hay un texto con título.\nEl título y el texto debajo\npueden ponerse en negrita, cursiva, color,\ntachado o subrayado. También puedes añadir listas,\ntablas, enlaces, fórmulas, anclas\ny bloques de código.",
  'heading': 'Texto',
});

// ─── bundle ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'bundle', {
  'error-title': 'Error en el editor YFM',
  'settings_wysiwyg': 'Editor visual (wysiwyg)',
  'settings_markup': 'Marcado Markdown',
  'settings_menubar': 'Barra de herramientas',
  'settings_hint': "Puedes desactivar el menú superior e invocar todos los comandos con '/' o el botón «+».",
  'settings_split-mode': 'Modo dividido',
  'split-mode-text': 'Vista previa',
  'settings_split-mode-hint': 'Divide el editor en dos ventanas: vista previa y edición',
  'markup_placeholder': 'Añade tu marcado aquí',
  'preview_label': 'Vista previa',
  'settings_label': 'Ajustes',
});

// ─── codeblock ──────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'codeblock', {
  'remove': 'Eliminar',
  'empty_option': 'Sin resultados',
  'code_wrapping': 'Ajuste de línea',
  'show_line_numbers': 'Números de línea',
});

// ─── common ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'common', {
  'cancel': 'Cancelar',
  'close': 'Cerrar',
  'delete': 'Eliminar',
  'edit': 'Editar',
  'preview': 'Vista previa',
  'remove': 'Quitar',
  'save': 'Guardar',
  'actions': 'Acciones',
  'toolbar_action_disabled': 'Elemento de marcado incompatible',
});

// ─── empty-row ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'empty-row', {
  'snippet.text': 'Línea vacía',
});

// ─── forms ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'forms', {
  'common_action_cancel': 'Cancelar',
  'common_action_submit': 'Confirmar',
  'common_action_upload': 'Subir',
  'common_tab_attach': 'Importar desde el dispositivo',
  'common_tab_link': 'Añadir por enlace',
  'common_link': 'Enlace',
  'common_sizes': 'Tamaño, px',
  'image_name': 'Título',
  'image_link_href': 'Enlace de la imagen',
  'image_link_href_help': 'Dirección a la que lleva el enlace de la imagen.',
  'image_alt': 'Texto alternativo',
  'image_alt_help': 'El texto alternativo se muestra si la imagen no puede cargarse.',
  'image_upload_help': 'Imagen JPEG, GIF o PNG de menos de 1 MB.',
  'image_upload_failed': 'Error al subir la imagen',
  'image_size_width': 'Ancho',
  'image_size_height': 'Alto',
  'link_url_help': 'Dirección a la que lleva el enlace.',
  'link_text': 'Texto del enlace',
  'link_text_help': 'Texto mostrado como enlace.',
  'link_open_help': 'Abrir el enlace en una pestaña nueva',
  'file_link_help': 'Enlace para descargar el archivo',
  'file_name': 'Nombre del archivo',
  'file_upload_help': 'Importa varios archivos a la vez desde tu dispositivo.',
  'file_upload_failed': 'Error al subir los archivos',
  'anchor_href': 'Identificador del ancla',
  'anchor_href_help': 'Compuesto de números, símbolos y letras latinas. Los anclas sirven para la navegación en la página.',
  'anchor_title': 'Información',
  'anchor_title_help': 'Texto de la información al pasar el cursor sobre el nodo ancla',
  'form_id': 'Enlace o identificador de formulario',
});

// ─── gallery ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'gallery', {
  'link_copied': 'Enlace copiado',
  'link_copy': 'Copiar enlace',
  'file_download': 'Descargar',
});

// ─── hints ───────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'hints', {
  'math_hint': 'Las matemáticas usan',
  'math_hint_katex': 'la sintaxis Katex',
});

// ─── math-hint ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'math-hint', {
  'math_hint': 'Las matemáticas usan',
  'math_hint_katex': 'la sintaxis Katex',
});

// ─── md-hints ────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'md-hints', {
  'header_title': 'Título',
  'header_hint': '# Tu texto',
  'italic_title': 'Cursiva',
  'italic_hint': '_Tu texto_',
  'bold_title': 'Negrita',
  'bold_hint': '**Tu texto**',
  'strikethrough_title': 'Tachado',
  'strikethrough_hint': '~~Tu texto~~',
  'blockquote_title': 'Cita',
  'blockquote_hint': '> Tu texto',
  'code_title': 'Código',
  'code_hint': '```Tu texto```',
  'link_title': 'Enlace',
  'link_hint': '[Tu texto](url)',
  'image_title': 'Imagen',
  'image_hint': '![Tu texto](url)',
  'list_title': 'Elemento de lista',
  'list_hint': '- Tu texto',
  'numbered-list_title': 'Lista numerada',
  'numbered-list_hint': '1. Tu texto',
  'documentation': 'Documentación',
  'documentation_link': ' https://diplodoc.com/docs/en/syntax/',
});

// ─── menubar ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'menubar', {
  'bold': 'Negrita',
  'checkbox': 'Casilla de verificación',
  'code': 'Código',
  'code_inline': 'Código en línea',
  'codeblock': 'Bloque de código',
  'colorify': 'Color del texto',
  'colorify__color_blue': 'Azul',
  'colorify__color_default': 'Por defecto',
  'colorify__color_gray': 'Gris',
  'colorify__color_green': 'Verde',
  'colorify__color_orange': 'Naranja',
  'colorify__color_red': 'Rojo',
  'colorify__color_violet': 'Violeta',
  'colorify__color_yellow': 'Amarillo',
  'colorify__group_text': 'Texto',
  'cut': 'Plegar',
  'emoji': 'Emoji',
  'emoji__hint': 'Los emojis pueden añadirse en WYSIWYG o manualmente con el marcado',
  'file': 'Archivo',
  'folding-heading': 'Sección plegable',
  'folding-heading__hint': 'El texto bajo el título puede plegarse o desplegarse',
  'gpt': 'Widget GPT',
  'heading': 'Título',
  'heading1': 'Título 1',
  'heading2': 'Título 2',
  'heading3': 'Título 3',
  'heading4': 'Título 4',
  'heading5': 'Título 5',
  'heading6': 'Título 6',
  'hrule': 'Separador',
  'html': 'HTML',
  'image': 'Imagen',
  'italic': 'Cursiva',
  'link': 'Enlace',
  'list': 'Lista',
  'list__action_lift': 'Subir el elemento',
  'list__action_sink': 'Bajar el elemento',
  'list_action_disabled': 'Contradice la lógica de la lista',
  'mark': 'Resaltado',
  'math': 'Matemáticas',
  'math_block': 'Bloque matemático',
  'math_inline': 'Matemáticas en línea',
  'mermaid': 'Mermaid',
  'mono': 'Monoespaciado',
  'more_action': 'Más acciones',
  'move_list': 'Mover el elemento',
  'note': 'Nota',
  'olist': 'Lista ordenada',
  'quote': 'Cita',
  'quotelink': 'Enlace de cita',
  'redo': 'Rehacer',
  'strike': 'Tachado',
  'table': 'Tabla',
  'tabs': 'Pestañas',
  'text': 'Texto',
  'ulist': 'Lista con viñetas',
  'underline': 'Subrayado',
  'undo': 'Deshacer',
});

// ─── placeholder ─────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'placeholder', {
  'doc_empty': "Escribe tu texto o teclea '/' para abrir la lista de comandos",
  'doc_empty_mobile': 'Escribe tu texto',
  'checkbox': 'Añade una descripción de la tarea o un punto de control',
  'codeblock': 'Añade código o texto al bloque',
  'deflist_term': 'Término de definición',
  'deflist_desc': 'Descripción de la definición',
  'heading': 'Título',
  'cut_title': 'Título del pliegue',
  'cut_content': 'Añade el texto que se mostrará al hacer clic',
  'note_title': 'Título de la nota',
  'note_content': 'Añade el contenido de la nota',
  'block': 'Bloque decorado',
  'layout_cell': 'Texto',
  'table_cell': 'Contenido de la celda',
  'select_filter': 'Buscar',
});

// ─── search ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'search', {
  'label_case-sensitive': 'Distinguir mayúsculas',
  'label_whole-word': 'Palabra completa',
  'title': 'Buscar y reemplazar',
  'action_close': 'Cerrar',
  'action_replace': 'Reemplazar',
  'action_replace_all': 'Reemplazar todo',
  'action_next': 'Siguiente',
  'action_prev': 'Anterior',
  'action_expand': 'Expandir el formulario de reemplazo',
  'title_search': 'Buscar',
  'title_replace': 'Reemplazar por',
  'search_counter': '{{current}} de {{total}}',
  'search_placeholder': 'Búsqueda de texto',
});

// ─── suggest ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'suggest', {
  'error-title': 'Error',
  'error-desc': 'Error de carga',
  'empty-msg': 'Sin resultados',
});

// ─── viewer ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'viewer', {
  'code_wrapping': 'Ajuste de línea',
});

// ─── widgets ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'widgets', {
  'iframe': 'Añadir un marco',
  'image': 'Añadir una imagen',
  'link': 'Añadir un enlace',
  'file': 'Añadir un archivo',
});

// ─── yfm-block ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-block', {
  'align': 'Alineación',
  'width': 'Ancho (px)',
  'padding': 'Márgenes internos',
  'border': 'Tipo de borde',
  'border-size': 'Grosor del borde',
  'border-color': 'Color del borde',
  'remove': 'Eliminar el bloque',
});

// ─── yfm-layout ──────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-layout', {
  'action.template.1': 'Dos celdas',
  'action.template.2': 'Celda grande a la derecha',
  'action.template.3': 'Celda grande a la izquierda',
  'action.template.4': 'Tres celdas',
  'action.align.left': 'Alinear a la izquierda',
  'action.align.center': 'Centrar',
  'action.align.right': 'Alinear a la derecha',
  'action.align.stretch': 'Estirar a todo el ancho',
  'action.remove': 'Eliminar',
  'cell.preview': 'Vista previa',
  'cell.width': 'Ancho',
  'cell.width.auto': 'Auto',
  'cell.remove': 'Eliminar la celda',
});

// ─── yfm-note ────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-note', {
  'info': 'Nota',
  'tip': 'Consejo',
  'warning': 'Advertencia',
  'alert': 'Alerta',
  'remove': 'Eliminar',
});

// ─── yfm-table ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-table', {
  'column.add.before': 'Añadir una columna antes',
  'column.add.after': 'Añadir una columna después',
  'column.remove': 'Eliminar la columna',
  'column.remove.multiple': 'Eliminar las columnas',
  'row.add.before': 'Añadir una fila antes',
  'row.add.after': 'Añadir una fila después',
  'row.remove': 'Eliminar la fila',
  'row.remove.multiple': 'Eliminar las filas',
  'cells.clear': 'Vaciar las celdas',
  'table.remove': 'Eliminar la tabla',
  'table.menu.cell.align.left': 'Alinear el contenido a la izquierda',
  'table.menu.cell.align.right': 'Alinear el contenido a la derecha',
  'table.menu.cell.align.center': 'Centrar el contenido',
  'table.menu.row.add': 'Añadir una fila después',
  'table.menu.row.remove': 'Eliminar la fila',
  'table.menu.column.add': 'Añadir una columna después',
  'table.menu.column.remove': 'Eliminar la columna',
  'table.menu.convert.yfm': 'Convertir en tabla YFM',
  'table.menu.table.remove': 'Eliminar la tabla',
});

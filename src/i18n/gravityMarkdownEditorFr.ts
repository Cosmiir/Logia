/**
 * French translations for @gravity-ui/markdown-editor
 *
 * Gravity UI only ships 'en' and 'ru' keysets. This file registers a custom
 * 'fr' language on the editor's internal i18n instance so that all UI strings
 * (placeholders, toolbar labels, dialogs…) appear in French when the app
 * language is set to 'fr'.
 *
 * Usage: import this file once, early in the app bootstrap (e.g. in main.tsx
 * or i18n/config.ts), BEFORE any Gravity editor component mounts.
 */

// The editor exposes its internal I18N instance through this path.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — private but stable export
import { i18n } from '@gravity-ui/markdown-editor/i18n';

const LANG = 'fr';

// ─── action-previews ────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'action-previews', {
  'text': "Voici un texte sans titre.\nLe titre et le texte en dessous\npeuvent être mis en gras, italique, couleur,\nbarré ou souligné. Vous pouvez aussi ajouter des listes,\ntableaux, liens, formules, ancres\net blocs de code.",
  'text-with-head': "Voici un texte avec titre.\nLe titre et le texte en dessous\npeuvent être mis en gras, italique, couleur,\nbarré ou souligné. Vous pouvez aussi ajouter des listes,\ntableaux, liens, formules, ancres\net blocs de code.",
  'heading': 'Texte',
});

// ─── bundle ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'bundle', {
  'error-title': "Erreur dans l'éditeur YFM",
  'settings_wysiwyg': 'Éditeur visuel (wysiwyg)',
  'settings_markup': 'Balisage Markdown',
  'settings_menubar': 'Barre d\'outils',
  'settings_hint': "Vous pouvez désactiver le menu du haut et invoquer toutes les commandes avec '/' ou le bouton «+».",
  'settings_split-mode': 'Mode séparé',
  'split-mode-text': 'Aperçu',
  'settings_split-mode-hint': "Divise l'éditeur en deux fenêtres : aperçu et édition",
  'markup_placeholder': 'Ajoutez votre balisage ici',
  'preview_label': 'Aperçu',
  'settings_label': 'Paramètres',
});

// ─── codeblock ──────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'codeblock', {
  'remove': 'Supprimer',
  'empty_option': 'Aucun résultat',
  'code_wrapping': 'Retour à la ligne',
  'show_line_numbers': 'Numéros de ligne',
});

// ─── common ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'common', {
  'cancel': 'Annuler',
  'close': 'Fermer',
  'delete': 'Supprimer',
  'edit': 'Modifier',
  'preview': 'Aperçu',
  'remove': 'Retirer',
  'save': 'Enregistrer',
  'actions': 'Actions',
  'toolbar_action_disabled': 'Élément de balisage incompatible',
});

// ─── empty-row ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'empty-row', {
  'snippet.text': 'Ligne vide',
});

// ─── forms ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'forms', {
  'common_action_cancel': 'Annuler',
  'common_action_submit': 'Valider',
  'common_action_upload': 'Téléverser',
  'common_tab_attach': 'Importer depuis l\'appareil',
  'common_tab_link': 'Ajouter par lien',
  'common_link': 'Lien',
  'common_sizes': 'Taille, px',
  'image_name': 'Titre',
  'image_link_href': 'Lien de l\'image',
  'image_link_href_help': 'Adresse vers laquelle le lien de l\'image mène.',
  'image_alt': 'Texte alternatif',
  'image_alt_help': 'Le texte alternatif s\'affiche si l\'image ne peut pas être chargée.',
  'image_upload_help': 'Image JPEG, GIF ou PNG de moins de 1 Mo.',
  'image_upload_failed': 'Échec du téléversement de l\'image',
  'image_size_width': 'Largeur',
  'image_size_height': 'Hauteur',
  'link_url_help': 'Adresse vers laquelle le lien mène.',
  'link_text': 'Texte du lien',
  'link_text_help': 'Texte affiché comme lien.',
  'link_open_help': 'Ouvrir le lien dans un nouvel onglet',
  'file_link_help': 'Lien pour télécharger le fichier',
  'file_name': 'Nom du fichier',
  'file_upload_help': 'Importez plusieurs fichiers à la fois depuis votre appareil.',
  'file_upload_failed': 'Échec du téléversement des fichiers',
  'anchor_href': 'Identifiant de l\'ancre',
  'anchor_href_help': 'Composé de chiffres, symboles et lettres latines. Les ancres servent à la navigation dans la page.',
  'anchor_title': 'Infobulle',
  'anchor_title_help': 'Texte de l\'infobulle au survol du nœud ancre',
  'form_id': 'Lien ou identifiant de formulaire',
});

// ─── gallery ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'gallery', {
  'link_copied': 'Lien copié',
  'link_copy': 'Copier le lien',
  'file_download': 'Télécharger',
});

// ─── hints ───────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'hints', {
  'math_hint': 'Les maths utilisent',
  'math_hint_katex': 'la syntaxe Katex',
});

// ─── math-hint ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'math-hint', {
  'math_hint': 'Les maths utilisent',
  'math_hint_katex': 'la syntaxe Katex',
});

// ─── md-hints ────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'md-hints', {
  'header_title': 'Titre',
  'header_hint': '# Votre texte',
  'italic_title': 'Italique',
  'italic_hint': '_Votre texte_',
  'bold_title': 'Gras',
  'bold_hint': '**Votre texte**',
  'strikethrough_title': 'Barré',
  'strikethrough_hint': '~~Votre texte~~',
  'blockquote_title': 'Citation',
  'blockquote_hint': '> Votre texte',
  'code_title': 'Code',
  'code_hint': '```Votre texte```',
  'link_title': 'Lien',
  'link_hint': '[Votre texte](url)',
  'image_title': 'Image',
  'image_hint': '![Votre texte](url)',
  'list_title': 'Élément de liste',
  'list_hint': '- Votre texte',
  'numbered-list_title': 'Liste numérotée',
  'numbered-list_hint': '1. Votre texte',
  'documentation': 'Documentation',
  'documentation_link': ' https://diplodoc.com/docs/en/syntax/',
});

// ─── menubar ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'menubar', {
  'bold': 'Gras',
  'checkbox': 'Case à cocher',
  'code': 'Code',
  'code_inline': 'Code en ligne',
  'codeblock': 'Bloc de code',
  'colorify': 'Couleur du texte',
  'colorify__color_blue': 'Bleu',
  'colorify__color_default': 'Par défaut',
  'colorify__color_gray': 'Gris',
  'colorify__color_green': 'Vert',
  'colorify__color_orange': 'Orange',
  'colorify__color_red': 'Rouge',
  'colorify__color_violet': 'Violet',
  'colorify__color_yellow': 'Jaune',
  'colorify__group_text': 'Texte',
  'cut': 'Replier',
  'emoji': 'Emoji',
  'emoji__hint': 'Les emojis peuvent être ajoutés en WYSIWYG ou manuellement avec le balisage',
  'file': 'Fichier',
  'folding-heading': 'Section repliable',
  'folding-heading__hint': 'Le texte sous le titre peut être replié ou déplié',
  'gpt': 'Widget GPT',
  'heading': 'Titre',
  'heading1': 'Titre 1',
  'heading2': 'Titre 2',
  'heading3': 'Titre 3',
  'heading4': 'Titre 4',
  'heading5': 'Titre 5',
  'heading6': 'Titre 6',
  'hrule': 'Séparateur',
  'html': 'HTML',
  'image': 'Image',
  'italic': 'Italique',
  'link': 'Lien',
  'list': 'Liste',
  'list__action_lift': 'Remonter l\'élément',
  'list__action_sink': 'Descendre l\'élément',
  'list_action_disabled': 'Contredit la logique de la liste',
  'mark': 'Surligné',
  'math': 'Maths',
  'math_block': 'Bloc mathématique',
  'math_inline': 'Maths en ligne',
  'mermaid': 'Mermaid',
  'mono': 'Monospace',
  'more_action': 'Plus d\'actions',
  'move_list': 'Déplacer l\'élément',
  'note': 'Note',
  'olist': 'Liste ordonnée',
  'quote': 'Citation',
  'quotelink': 'Lien de citation',
  'redo': 'Rétablir',
  'strike': 'Barré',
  'table': 'Tableau',
  'tabs': 'Onglets',
  'text': 'Texte',
  'ulist': 'Liste à puces',
  'underline': 'Souligné',
  'undo': 'Annuler',
});

// ─── placeholder ─────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'placeholder', {
  'doc_empty': "Saisissez votre texte ou tapez '/' pour ouvrir la liste des commandes",
  'doc_empty_mobile': 'Saisissez votre texte',
  'checkbox': 'Ajoutez une description de la tâche ou un point de contrôle',
  'codeblock': 'Ajoutez du code ou du texte au bloc',
  'deflist_term': 'Terme de définition',
  'deflist_desc': 'Description de la définition',
  'heading': 'Titre',
  'cut_title': 'Titre du repli',
  'cut_content': 'Ajoutez le texte qui s\'affichera au clic',
  'note_title': 'Titre de la note',
  'note_content': 'Ajoutez le contenu de la note',
  'block': 'Bloc décoré',
  'layout_cell': 'Texte',
  'table_cell': 'Contenu de la cellule',
  'select_filter': 'Rechercher',
});

// ─── search ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'search', {
  'label_case-sensitive': 'Respecter la casse',
  'label_whole-word': 'Mot entier',
  'title': 'Rechercher et remplacer',
  'action_close': 'Fermer',
  'action_replace': 'Remplacer',
  'action_replace_all': 'Tout remplacer',
  'action_next': 'Suivant',
  'action_prev': 'Précédent',
  'action_expand': 'Développer le formulaire de remplacement',
  'title_search': 'Rechercher',
  'title_replace': 'Remplacer par',
  'search_counter': '{{current}} sur {{total}}',
  'search_placeholder': 'Recherche de texte',
});

// ─── suggest ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'suggest', {
  'error-title': 'Erreur',
  'error-desc': 'Erreur de chargement',
  'empty-msg': 'Aucun résultat',
});

// ─── viewer ──────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'viewer', {
  'code_wrapping': 'Retour à la ligne',
});

// ─── widgets ─────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'widgets', {
  'iframe': 'Ajouter un cadre',
  'image': 'Ajouter une image',
  'link': 'Ajouter un lien',
  'file': 'Ajouter un fichier',
});

// ─── yfm-block ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-block', {
  'align': 'Alignement',
  'width': 'Largeur (px)',
  'padding': 'Marges internes',
  'border': 'Type de bordure',
  'border-size': 'Épaisseur de bordure',
  'border-color': 'Couleur de bordure',
  'remove': 'Supprimer le bloc',
});

// ─── yfm-layout ──────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-layout', {
  'action.template.1': 'Deux cellules',
  'action.template.2': 'Grande cellule à droite',
  'action.template.3': 'Grande cellule à gauche',
  'action.template.4': 'Trois cellules',
  'action.align.left': 'Aligner à gauche',
  'action.align.center': 'Centrer',
  'action.align.right': 'Aligner à droite',
  'action.align.stretch': 'Étirer sur toute la largeur',
  'action.remove': 'Supprimer',
  'cell.preview': 'Aperçu',
  'cell.width': 'Largeur',
  'cell.width.auto': 'Auto',
  'cell.remove': 'Supprimer la cellule',
});

// ─── yfm-note ────────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-note', {
  'info': 'Note',
  'tip': 'Conseil',
  'warning': 'Avertissement',
  'alert': 'Alerte',
  'remove': 'Supprimer',
});

// ─── yfm-table ───────────────────────────────────────────────────────────────
i18n.registerKeyset(LANG, 'yfm-table', {
  'column.add.before': 'Ajouter une colonne avant',
  'column.add.after': 'Ajouter une colonne après',
  'column.remove': 'Supprimer la colonne',
  'column.remove.multiple': 'Supprimer les colonnes',
  'row.add.before': 'Ajouter une ligne avant',
  'row.add.after': 'Ajouter une ligne après',
  'row.remove': 'Supprimer la ligne',
  'row.remove.multiple': 'Supprimer les lignes',
  'cells.clear': 'Vider les cellules',
  'table.remove': 'Supprimer le tableau',
  'table.menu.cell.align.left': 'Aligner le contenu à gauche',
  'table.menu.cell.align.right': 'Aligner le contenu à droite',
  'table.menu.cell.align.center': 'Centrer le contenu',
  'table.menu.row.add': 'Ajouter une ligne après',
  'table.menu.row.remove': 'Supprimer la ligne',
  'table.menu.column.add': 'Ajouter une colonne après',
  'table.menu.column.remove': 'Supprimer la colonne',
  'table.menu.convert.yfm': 'Convertir en tableau YFM',
  'table.menu.table.remove': 'Supprimer le tableau',
});

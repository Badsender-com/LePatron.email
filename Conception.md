### Objectif

### API

Deelan is working on a API in the moment of the writing of this conception, the API expected is

```
POST /mailings/:mailingId/copy

Body {
mailingId : String // id of mail to copy,
workspaceId : String // id of destination workspace
}
```

### Front

- Add a component, ModalCopyMail, contain

```
<modal-copy-mail
 ref="copyMailDialog"
 :title="`${$t('global.copyMail')} ?`"
 :action-label="$t('global.copyMail')"
 :confirmation-input-label="
            $t('mailing.copyMailConfirmation')
          "
 @confirm="copyMail"
>
          <p
            class="black--text"
            v-html="
              $t('mailing.copyMailConfirmationMessage')
            "
          />
        </bs-modal-confirm-form>

```

```
<modal-copy-mail
          ref="copyMailDialog"
          :title="`${$t('global.copyMail')} ?`"
          :action-label="$t('global.copyMail')"
          :confirmation-input-label="
            $t('mailing.copyMailConfirmation')
          "
         @confirm="copyMail"
        >
          <p
            class="black--text"
            v-html="
              $t('mailing.copyMailConfirmationMessage')
            "
          />
        </bs-modal-confirm-form>

```

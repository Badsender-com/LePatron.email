<script>
// One setting of a company, drawn as the module cards are: a bordered card, an
// icon on a tile, a name and a sentence, the switch on the right. A setting
// that needs fields unfolds them in its own card (the `body` slot).
export default {
  name: 'BsGroupSettingCard',
};
</script>

<template>
  <div class="bs-group-setting-card">
    <div class="bs-group-setting-card__row">
      <div class="bs-group-setting-card__content">
        <div class="bs-group-setting-card__icon" aria-hidden="true">
          <slot name="icon" />
        </div>
        <div class="bs-group-setting-card__info">
          <div class="bs-group-setting-card__name">
            <slot name="name" />
          </div>
          <div class="bs-group-setting-card__description">
            <slot name="description" />
          </div>
          <div v-if="$slots.hint" class="bs-group-setting-card__hint">
            <slot name="hint" />
          </div>
        </div>
      </div>
      <div class="bs-group-setting-card__control">
        <slot name="control" />
      </div>
    </div>
    <div v-if="$slots.body" class="bs-group-setting-card__body">
      <slot name="body" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-group-setting-card {
  padding: 1rem;
  margin-bottom: 0.75rem;
  background-color: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 8px;
  transition: border-color 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    border-color: rgba(0, 172, 220, 0.4);
  }

  &__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  &__content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    min-width: 0;
  }

  &__icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 172, 220, 0.1);
    border-radius: 8px;
    flex-shrink: 0;
    color: #00acdc;
  }

  &__info {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name {
    font-weight: 500;
    font-size: 1rem;
    color: rgba(0, 0, 0, 0.87);
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin-top: 0.25rem;
  }

  &__hint {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
  }

  &__control {
    flex-shrink: 0;
  }

  &__body {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
  }
}
</style>

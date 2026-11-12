<!-- App.vue -->
<script setup lang="ts">
  import 'html-combobox-element';
  import { ref, onMounted, onBeforeUnmount } from 'vue';

  const boxRef = ref<HTMLElementTagNameMap['combo-box'] | null>(null);

  function onChange(e: Event) {
  const target = e.target as HTMLComboBoxElement;
  console.log(target.valueAsArray);
}

  onMounted(() => boxRef.value?.addEventListener('change', onChange));
  onBeforeUnmount(() => boxRef.value?.removeEventListener('change', onChange));
</script>

<template>
  <combo-box ref="boxRef" name="fruit" multiple value="apple">
    <box-option value="apple">Apple</box-option>
    <box-tag />
  </combo-box>
</template>

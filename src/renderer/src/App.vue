<script setup>
import { ref } from 'vue'
import AuthChecker from './views/AuthChecker.vue'
import HistoryManager from './views/HistoryManager.vue'
import LogManager from './views/LogManager.vue'

const currentPage = ref('main') // 'main', 'history', 'logs'

const handleOpenHistoryManager = () => {
  currentPage.value = 'history'
}

const handleOpenLogManager = () => {
  currentPage.value = 'logs'
}

const handleBack = () => {
  currentPage.value = 'main'
}
</script>

<template>
  <HistoryManager v-if="currentPage === 'history'" @back="handleBack" />
  <LogManager v-else-if="currentPage === 'logs'" @back="handleBack" />
  <AuthChecker v-else @open-history-manager="handleOpenHistoryManager" @open-log-manager="handleOpenLogManager" />
</template>

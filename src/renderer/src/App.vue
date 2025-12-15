<script setup>
import { ref, watch } from 'vue'
import AuthChecker from './views/AuthChecker.vue'
import HistoryManager from './views/HistoryManager.vue'
import LogManager from './views/LogManager.vue'

// 从 localStorage 恢复当前页面状态
const getSavedPage = () => {
  try {
    const saved = localStorage.getItem('app-current-page')
    return saved || 'main'
  } catch {
    return 'main'
  }
}

const currentPage = ref(getSavedPage()) // 'main', 'history', 'logs'

// 监听页面变化并保存到 localStorage
watch(currentPage, (newPage) => {
  try {
    localStorage.setItem('app-current-page', newPage)
  } catch (err) {
    console.error('保存页面状态失败:', err)
  }
})

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
  <HistoryManager v-show="currentPage === 'history'" @back="handleBack" />
  <LogManager v-show="currentPage === 'logs'" @back="handleBack" />
  <AuthChecker v-show="currentPage === 'main'" @open-history-manager="handleOpenHistoryManager" @open-log-manager="handleOpenLogManager" />
</template>

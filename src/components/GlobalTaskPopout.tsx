import { useProjects } from '@/context/ProjectContext'
import { TaskDetailsPopout } from './TaskDetailsPopout'

export function GlobalTaskPopout() {
  const { poppedOutTask, getPoppedOutTask, clearPoppedOutTask } = useProjects()
  
  const task = getPoppedOutTask()
  
  if (!poppedOutTask || !task) {
    return null
  }

  return (
    <TaskDetailsPopout
      task={task}
      isOpen={true}
      onClose={clearPoppedOutTask}
      onMinimize={clearPoppedOutTask}
    />
  )
}
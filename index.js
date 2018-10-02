const lockTableName = 'SequelizeLock'
const sleep = delay => new Promise(resolve => setTimeout(resolve, delay))

module.exports = (queryInterface, logger = console) => {
  async function obtainLock () {
    try {
      await queryInterface.sequelize.query(`CREATE TABLE "${lockTableName}"(id INTEGER)`)

      logger.warn('Lock successfully obtained, starting migration')
      return true
    } catch (error) {
      return false
    }
  }

  async function releaseLock () {
    await queryInterface.dropTable(lockTableName)
    logger.warn('Releasing lock')
  }

  async function isLocked () {
    try {
      await queryInterface.describeTable(lockTableName)
      return true
    } catch (error) {
      return false
    }
  }

  async function waitForMigration (lastMigration) {
    logger.warn('Other migration running, waiting for finish')

    while (true) {
      await sleep(1000)

      if (!await isLocked()) {
        const newLastMigration = await getLastMigration()

        if (newLastMigration !== lastMigration) {
          logger.warn({ newLastMigration, lastMigration })
          logger.warn('Migration host successfully finished migration')
          return
        }

        throw new Error('Migration host did not completed running migration')
      }
    }
  }

  async function lockOrWait () {
    const lastMigration = await getLastMigration()

    if (await obtainLock()) {
      return true
    }

    await waitForMigration(lastMigration)
    return false
  }

  async function getLastMigration () {
    const { sequelize } = queryInterface
    const [{ name }] = await sequelize.query(
      'SELECT name FROM "SequelizeMeta" ORDER BY name DESC',
      { type: sequelize.QueryTypes.SELECT }
    )

    return name
  }

  return {
    lockOrWait,
    releaseLock,
  }
}

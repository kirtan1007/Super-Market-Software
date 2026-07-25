const mongoose = require('mongoose');

function createTenantProxy(modelName, schema) {
  // Register the model on the default mongoose connection
  mongoose.model(modelName, schema);

  const globalModels = ['User', 'LoginHistory', 'OtpVerification', 'ActivityLog', 'Plan', 'PaymentRequest', 'MailLog'];

  const getTenantModel = () => {
    if (globalModels.includes(modelName)) {
      return mongoose.models[modelName] || mongoose.model(modelName);
    }

    const asyncLocalStorage = require('./tenantContext');
    const store = asyncLocalStorage.getStore();
    if (store && store.ownerId) {
      let dbName = store.databaseName;
      if (!dbName) {
        const shopSlug = store.shopSlug || 'shop';
        dbName = `tenant_${shopSlug}_${store.ownerId}`;
      }
      const tenantDb = mongoose.connection.useDb(dbName, { useCache: true });
      if (tenantDb.models[modelName]) {
        return tenantDb.models[modelName];
      }
      return tenantDb.model(modelName, schema);
    }
    return mongoose.models[modelName] || mongoose.model(modelName);
  };

  return new Proxy(function() {}, {
    get: (target, prop) => {
      const model = getTenantModel();
      const val = model[prop];
      if (typeof val === 'function') {
        return val.bind(model);
      }
      return val;
    },
    construct: (target, args) => {
      const ModelClass = getTenantModel();
      return new ModelClass(...args);
    }
  });
}

module.exports = createTenantProxy;

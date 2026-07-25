const mongoose = require('mongoose');
const asyncLocalStorage = require('./tenantContext');

const saasPlugin = (schema) => {
  // Define multi-tenant fields on all schemas
  if (!schema.path('ownerId')) {
    schema.add({
      ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
      }
    });
  }
  if (!schema.path('shopId')) {
    schema.add({
      shopId: {
        type: String,
        index: true
      }
    });
  }
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: String,
        index: true
      }
    });
  }

  // Pre-save validation & self-injection hook
  schema.pre('save', function(next) {
    const isSubDoc = typeof this.ownerDocument === 'function' && this.ownerDocument() !== this;
    if (!isSubDoc) {
      // Self-inject tenant fields from execution context if present
      const store = asyncLocalStorage.getStore();
      if (store) {
        if (!this.ownerId) this.ownerId = store.ownerId;
        if (!this.shopId) this.shopId = store.shopId;
        if (!this.tenantId) this.tenantId = store.tenantId;
      }

      const colName = this.constructor.modelName;
      const globalModels = ['User', 'LoginHistory', 'OtpVerification', 'ActivityLog', 'Plan', 'PaymentRequest', 'MailLog', 'GlobalConfig', 'Setting'];
      const isPublic = globalModels.includes(colName);

      if (!isPublic) {
        if (!this.ownerId) {
          return next(new Error(`SaaS Validation Error: ownerId is required on top-level collection '${colName}'`));
        }
        if (!this.shopId) {
          return next(new Error(`SaaS Validation Error: shopId is required on top-level collection '${colName}'`));
        }
        if (!this.tenantId) {
          return next(new Error(`SaaS Validation Error: tenantId is required on top-level collection '${colName}'`));
        }
      }
    }
    next();
  });

  // Pre-query hooks to inject ownerId automatically
  const queryHooks = [
    'find',
    'findOne',
    'countDocuments',
    'estimatedDocumentCount',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'findOneAndUpdate',
    'findOneAndDelete'
  ];

  queryHooks.forEach(hook => {
    schema.pre(hook, function(next) {
      const colName = this.model.modelName;
      const globalModels = ['User', 'LoginHistory', 'OtpVerification', 'ActivityLog', 'Plan', 'PaymentRequest', 'MailLog', 'GlobalConfig', 'Setting'];
      if (globalModels.includes(colName)) {
        return next();
      }

      const store = asyncLocalStorage.getStore();
      if (store && store.ownerId) {
        this.where({ ownerId: store.ownerId });
      }
      next();
    });
  });

  // Pre-aggregate hook to inject ownerId automatically
  schema.pre('aggregate', function(next) {
    const colName = this._model.modelName;
    const globalModels = ['User', 'LoginHistory', 'OtpVerification', 'ActivityLog', 'Plan', 'PaymentRequest', 'MailLog', 'GlobalConfig', 'Setting'];
    if (globalModels.includes(colName)) {
      return next();
    }

    const store = asyncLocalStorage.getStore();
    if (store && store.ownerId) {
      this.pipeline().unshift({ 
        $match: { ownerId: new mongoose.Types.ObjectId(store.ownerId) } 
      });
    }
    next();
  });
};

module.exports = saasPlugin;
